import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'status': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'status': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'status': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}