// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  devtools: {
    enabled: true
  },
  nitro: {
    experimental: {
      websocket: true
    },
  }
})
