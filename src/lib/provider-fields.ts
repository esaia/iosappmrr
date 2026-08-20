/**
 * The credential fields each provider needs.
 *
 * Kept out of the adapters so those stay free of UI concerns, and out of any
 * one page so the connect screen and the submit form ask for the same things.
 * Two copies of this list would drift, and the symptom would be a form that
 * collects a field the adapter never reads.
 */
export const PROVIDER_FIELDS: Record<
  string,
  { name: string; label: string; type?: string; placeholder?: string; multiline?: boolean }[]
> = {
  revenuecat: [
    { name: 'projectId', label: 'Project ID', placeholder: 'proj1ab2cd3e' },
    { name: 'apiKey', label: 'V2 secret key', type: 'password', placeholder: 'sk_…' },
  ],
  adapty: [
    { name: 'secretKey', label: 'Secret key', type: 'password', placeholder: 'secret_live_…' },
  ],
  app_store_connect: [
    { name: 'issuerId', label: 'Issuer ID', placeholder: '57246542-96fe-1a63-e053-0824d011072a' },
    { name: 'keyId', label: 'Key ID', placeholder: '2X9R4HXF34' },
    { name: 'vendorNumber', label: 'Vendor number', placeholder: '85123456' },
    {
      name: 'privateKey',
      label: 'Private key (.p8 contents)',
      multiline: true,
      placeholder: '-----BEGIN PRIVATE KEY-----',
    },
  ],
  stripe: [
    { name: 'secretKey', label: 'Restricted key', type: 'password', placeholder: 'rk_live_…' },
  ],
}
