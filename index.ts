#!/usr/bin/env -S node -r "ts-node/register"

import fs from 'fs'
import path from 'path'

import dotenv from 'dotenv'
import decache from 'decache'
import express from "express"
import { Request, Response, NextFunction } from "express-serve-static-core"
import cookieParser from 'cookie-parser'

const app = express()
const PORT = process.env.PORT || 3000
const ROOT_DIR = path.resolve(process.env.ROOT_DIR || './src/')
const API_DIR = process.env.API_DIR ? 
  path.resolve(process.env.API_DIR) + '/' : 
  path.resolve(ROOT_DIR, './api/') + '/'

const ENV_PATH = path.join(ROOT_DIR, '.env')

// Start with loading env variables
if (fs.existsSync(ENV_PATH)) {
  dotenv.config({ path: ENV_PATH })
  console.log("Loaded " + ENV_PATH)
} else console.log(".env not found at " + ENV_PATH)

// add cookies to request
app.use(cookieParser())

// First middleware
app.use(function (req, res, next) {
  const now = new Date()
  console.log(now.toISOString(), req.ip, req.method, req.path)
  next()
})

// Detect app requests
app.use(function (req, res, next) {
  if (req.path.startsWith('/api')) APIhandler(req, res, next)
  else next()
})

// Deal with static files
app.use(express.static(ROOT_DIR, {
  extensions: ['html', 'htm']
}))

// Start server
app.listen(PORT, () => {
  console.log(`Started server on http://localhost:${PORT}, with ROOT_DIR = ${ROOT_DIR}`)
})

async function addRequestBody(request: Request) {
  const buffers = []

  for await (const chunk of request) {
    buffers.push(chunk)
  }
  
  const data = Buffer.concat(buffers).toString()
  request.body = data
}

async function APIhandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filePath = APIpathResolver(req.path.slice(4))
    decache(filePath) // Make sure it is not cached
    let module = await import(filePath)

    await addRequestBody(req)

    await module.default(req, res)
  } catch (err: any) {
    console.error("Caught error: ", err)
    if (err.code === 'MODULE_NOT_FOUND') {
      res.status(400)
      res.send('This API function is not found')
    } else {
      res.status(500)
      res.send('ERROR: \n' + err)
    }
  }
}

function APIpathResolver(URLpath: string) {
  const filePath = path.join(API_DIR, URLpath)
  if (filePath.indexOf(API_DIR) !== 0) throw new Error('Trying to do path traversal?')
  if (filePath.endsWith('/')) return filePath + 'index'
  else return filePath
}

