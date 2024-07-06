import {defineType, defineField} from 'sanity'
import type {PreviewProps} from 'sanity'

export function iframePreview(props: PreviewProps) {
  const {title: html} = props
  if (typeof html !== 'string') { return null; }
  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  )
}

export default defineType({
  name: 'iframe',
  type: 'object',
  title: 'iframe Embed',
  fields: [
    defineField({
      name: 'html',
      type: 'string',
      title: 'iframe HTML',
    }),
  ],
  components: {
    preview: iframePreview,
  },
})