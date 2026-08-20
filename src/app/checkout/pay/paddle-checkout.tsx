'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { initializePaddle } from '@paddle/paddle-js'

/**
 * Loads Paddle.js and lets it open the checkout for the transaction in the URL.
 *
 * The overlay is opened by Paddle itself: when Paddle.js initialises on a page
 * carrying `_ptxn`, it fetches that transaction and draws the checkout. So
 * there is no `open()` call here to get out of step with what the server
 * created — this component's whole job is to be present and initialised.
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
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    initializePaddle({
      token,
      environment,
      eventCallback(event) {
        /*
         * The completion event is a courtesy, not proof: it fires in the
         * customer's browser, which can be closed, scripted, or lying. It only
         * moves them along to the page that says the purchase is being applied.
         * The grant itself waits for the signed webhook.
         */
        if (event.name === 'checkout.completed' && !cancelled) {
          router.push('/checkout/success')
        }
      },
    }).catch((error) => {
      console.error('[paddle] could not initialise checkout', error)
    })

    return () => {
      cancelled = true
    }
  }, [token, environment, router])

  return null
}
