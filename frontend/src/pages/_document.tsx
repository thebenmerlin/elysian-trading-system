import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="Elysian Trading System - AI-Powered Trading Dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body className="bg-terminal-bg text-terminal-primary">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
