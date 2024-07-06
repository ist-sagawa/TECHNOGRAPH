import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from './schemeTypes/index'
import { codeInput } from '@sanity/code-input'

export default defineConfig({
  name: "technograph", // Can be whatever
  title: "TECHNOGRAPH", // Can be whatever
  projectId: 'nacdthna',
  dataset: 'production',
  plugins: [structureTool(),codeInput()],
  schema: {
    types: schemaTypes
  },
});