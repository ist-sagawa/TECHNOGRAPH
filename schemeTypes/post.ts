import {defineField, defineType} from 'sanity'
import {IoDocumentTextOutline as icon} from 'react-icons/io5'

export default defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  icon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 100,
      },
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: {type: 'category'},
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
    defineField({
      name: 'releaseDate',
      title: 'Release date',
      type: 'datetime',
    }),
    defineField({
      name: 'mainImage',
      title: 'Main Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
  ],
  preview: {
    select: {
      title: 'title',
      date: 'releaseDate',
      media: 'image',
    },
    prepare(selection) {
      const year = selection.date && selection.date.split('-')[0]

      return {
        title: `${selection.title} ${year ? `(${year})` : ''}`,
        date: selection.date,
        media: selection.media,
      }
    },
  },
})
