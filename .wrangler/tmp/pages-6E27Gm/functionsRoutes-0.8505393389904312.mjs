import { onRequestGet as __api_crystalizer_gallery_js_onRequestGet } from "/Users/t-sagawa/Sites/IST/TECHNOGRAPH/functions/api/crystalizer/gallery.js"
import { onRequestPost as __api_crystalizer_upload_js_onRequestPost } from "/Users/t-sagawa/Sites/IST/TECHNOGRAPH/functions/api/crystalizer/upload.js"
import { onRequest as ___middleware_js_onRequest } from "/Users/t-sagawa/Sites/IST/TECHNOGRAPH/functions/_middleware.js"

export const routes = [
    {
      routePath: "/api/crystalizer/gallery",
      mountPath: "/api/crystalizer",
      method: "GET",
      middlewares: [],
      modules: [__api_crystalizer_gallery_js_onRequestGet],
    },
  {
      routePath: "/api/crystalizer/upload",
      mountPath: "/api/crystalizer",
      method: "POST",
      middlewares: [],
      modules: [__api_crystalizer_upload_js_onRequestPost],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_js_onRequest],
      modules: [],
    },
  ]