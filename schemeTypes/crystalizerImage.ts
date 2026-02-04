import { defineField, defineType } from 'sanity'
import { IoSparklesOutline as icon } from 'react-icons/io5'

export default defineType({
  name: 'crystalizerImage',
  title: 'Crystalizer Image',
  type: 'document',
  icon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'date',
      description: 'User-provided date (e.g. sketch date)',
    }),
    defineField({
      name: 'externalId',
      title: 'ID',
      type: 'string',
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
    }),
    defineField({
      name: 'message',
      title: 'Message',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'createdAt',
      title: 'Created at',
      type: 'datetime',
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'imageTransparent',
      title: 'Image (Transparent)',
      type: 'image',
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: {
      title: 'title',
      media: 'image',
      createdAt: 'createdAt',
      date: 'date',
      name: 'name',
    },
    prepare(selection) {
      const created = selection.createdAt ? new Date(selection.createdAt).toISOString().slice(0, 10) : ''
      const d = selection.date || ''
      const n = selection.name ? String(selection.name) : ''
      const parts = [d && `Date: ${d}`, created && `Saved: ${created}`, n && `By: ${n}`].filter(Boolean)
      return {
        title: selection.title,
        subtitle: parts.length ? parts.join(' · ') : undefined,
        media: selection.media,
      }
    },
  },
})
