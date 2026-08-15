/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // CLAUDE.md at the repo root is the VeilPay project spec (see file header).
  // Next.js 16's default agent-rules autogeneration would append its own block
  // to it on every dev/build. Disabled to keep the spec authoritative.
  agentRules: false,
}

module.exports = nextConfig
