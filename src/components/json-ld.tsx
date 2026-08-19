/**
 * Emits one schema.org graph as a JSON-LD script tag.
 *
 * `<` is escaped rather than left as-is: any string reaching here can come from
 * a founder-supplied field, and a literal `</script>` inside the JSON would end
 * the tag early and let the rest run as markup.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
