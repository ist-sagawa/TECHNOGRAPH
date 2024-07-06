import {defineType, defineField} from 'sanity'
import type {PreviewProps} from 'sanity'
import {PlayIcon} from '@sanity/icons'
import {Flex, Text} from '@sanity/ui'
import YouTubePlayer from 'react-player/youtube'

export function YouTubePreview(props: PreviewProps) {
  const {title: url} = props

  return (
    <Flex padding={3} align="center" justify="center">
      {typeof url === 'string' 
        ? <YouTubePlayer url={url} /> 
        : <Text>Add a YouTube URL</Text>}
    </Flex>
  )
}

export default defineType({
  name: 'youtube',
  type: 'object',
  title: 'YouTube Embed',
  icon: PlayIcon,
  fields: [
    defineField({
      name: 'url',
      type: 'url',
      title: 'YouTube video URL',
    }),
  ],
  preview: {
    select: {title: 'url'},
  },
  components: {
    preview: YouTubePreview,
  },
})