import { defineType } from "sanity";

const CodePenPreview = (value: any) => {
  const url = value.title;
  if (!url) {
    return (<div>Add a CodePen URL</div>)
  }
  const splitURL = url.split("/");
  // [ 'https:', '', 'codepen.io', 'sdras', 'pen', 'gWWQgb' ]
  const [, , , user, , hash] = splitURL;
  const embedUrl = `https://codepen.io/${user}/embed/${hash}?height=370&theme-id=dark&default-tab=result`;
  return (
    <iframe
      height="370"
      style={{ width: '100%' }}
      title="CodePen Embed"
      src={embedUrl}
      allowTransparency
      allowFullScreen
    />
  );
};

export default defineType({
  name: "codepen",
  type: "object",
  title: "CodePen Embed",
  components:{
    preview: CodePenPreview
  },
  fields: [
    {
      name: "url",
      type: "url",
      title: "CodePen URL"
    }
  ]
});