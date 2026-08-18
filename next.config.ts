import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /*
   * Dev-only asset requests from these hosts are allowed through.
   *
   * Next blocks cross-origin requests to /_next/* in development, so browsing
   * the dev server over an ngrok tunnel otherwise 404s every chunk and renders
   * a blank page. Tunnels are only needed to receive Polar webhooks locally;
   * this makes the UI usable over the same tunnel rather than only on
   * localhost. It has no effect on a production build.
   */
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.app', '*.ngrok.io'],
}

export default nextConfig
