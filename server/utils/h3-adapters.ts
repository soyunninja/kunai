import { deleteCookie, getCookie, getHeader, setCookie, type H3Event } from 'h3'

import type { CookieController, SessionCookieOptions } from './session'
import type { HeaderReader } from './same-origin'

export const h3HeaderReader = (event: H3Event): HeaderReader => ({
  getHeader: (name: string) => getHeader(event, name),
})

export const h3CookieController = (event: H3Event): CookieController => ({
  getCookie: (name: string) => getCookie(event, name),
  setCookie: (name: string, value: string, options: SessionCookieOptions) => {
    setCookie(event, name, value, options)
  },
  deleteCookie: (name: string, options: SessionCookieOptions) => {
    deleteCookie(event, name, options)
  },
})
