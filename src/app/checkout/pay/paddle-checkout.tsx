'use client'

import { useEffect, useState } from 'react'
import { initializePaddle } from '@paddle/paddle-js'

/** Where Paddle draws the checkout. Named, because Paddle.js finds it by id. */
const FRAME_ID = 'paddle-checkout-frame'

/**
 * Loads Paddle.js and lets it render the checkout for the transaction in the
 * URL, inline rather than as an overlay.
 *
 * Inline because this page is already the destination: the founder was sent
 * here by the buy button, so a modal floating over an otherwise empty page adds
 * a layer without adding anything. Paddle has no hosted checkout to redirect to
 * — the payment UI always belongs to the seller's page — and this is as close to
 * that redirect as the model allows.
 *
 * The checkout is still opened by Paddle itself: when Paddle.js initialises on
 * a page carrying `_ptxn`, it fetches that transaction and renders it with
 * whatever default settings it was given. So there is no `open()` call here to
 * get out of step with what the server created.
 *
 * The client token is not a secret. It can open a checkout and read prices,
 * which is all this page needs and all it can do; the API key that could move
 * money never leaves the server.
 */
export function PaddleCheckout({
  token,
  environment,
}: {
  token: string
  environment: 'sandbox' | 'production'
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    initializePaddle({
      token,
      environment,
      checkout: {
        settings: {
          displayMode: 'inline',
          /*
           * Light, against a site that is otherwise dark. A payment form is the
           * one place on here where looking like every other checkout beats
           * looking like the rest of the site: people are handing over a card,
           * and the dark treatment read as murky rather than as considered. The
           * card around the frame goes light with it, so the two are one
           * surface rather than a white panel bolted to a dark header.
           */
          theme: 'light',
          frameTarget: FRAME_ID,
          frameInitialHeight: 450,
          // Paddle sets width and border on the iframe itself; a transparent
          // background lets the card behind it show through instead of a white
          // block while the frame loads.
          frameStyle: 'width:100%; min-width:312px; background-color: transparent; border: none;',
          /*
           * Paddle sends the browser here when the payment completes. It is a
           * courtesy, not proof — the page it lands on grants nothing, and the
           * entitlement waits for the signed webhook.
           */
          successUrl: `${window.location.origin}/checkout/success`,
        },
      },
    }).catch((error) => {
      console.error('[paddle] could not initialise checkout', error)
      setFailed(true)
    })
  }, [token, environment])

  return (
    <>
      <div id={FRAME_ID} className={FRAME_ID} />
      {failed && (
        <p className="text-red text-[13px] leading-relaxed">
          The payment form could not be loaded. Reload the page, or try again in a moment.
        </p>
      )}
    </>
  )
}
