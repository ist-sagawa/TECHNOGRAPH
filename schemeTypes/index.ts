import blockContent from './blockContent'
import category from './category'
import post from './post'
import iframe from './iframe'
import codepen from './codepen'
import youtube from './youtube'
import crystalizerImage from './crystalizerImage'

export const schemaTypes = [
  // Document types
  post,
  crystalizerImage,

  // Other types
  blockContent,
  category,
  iframe,
  codepen,
  youtube,
]
