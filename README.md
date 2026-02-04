# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/basics)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/basics)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/basics/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

![just-the-basics](https://github.com/withastro/astro/assets/2244813/a0a5533c-a856-4198-8470-2d67b1d7c554)

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── Card.astro
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── package.json
```

## Development

### Crystalizer: Sanityへ画像送信（ローカルテスト）

`SEND` ボタンは `/api/crystallizer/upload`（Cloudflare Pages Functions）に multipart でPNGを送って、Sanityに asset + `crystalizerImage` ドキュメントを作成します。

ローカルで試すには Wrangler を使うのが一番簡単です。

1) 環境変数を用意

`.dev.vars` を作成（ひな形: `.dev.vars.example`）して、`SANITY_API_WRITE_TOKEN`（write権限）を入れてください。

2) Astro dev を起動

`npm run dev`

3) Functions込みで起動（別ターミナル）

`npx -y wrangler pages dev --proxy 4321`

`wrangler pages dev` のURL（通常 `http://127.0.0.1:8788`）でサイトを開くと、`/api/crystallizer/upload` がローカルでも動きます。

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
| `npm run new ...`         | Create a new sketch (e.g. `npm run new Title`)   |
| `npm run change ...`      | Update a sketch (e.g. `npm run change 251120 NewTitle`) |
| `npm run delete ...`      | Delete a sketch (e.g. `npm run delete 251120`)   |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).


---


# 使い方まとめ
## 🆕 新規作成 (npm run new)

```
npm run new タイトル （今日の日付で作成）
npm run new 251120 タイトル （日付指定で作成） ※すでにフォルダがある場合はエラーになります。
```

## 🔄 変更 (npm run change)

```
npm run change 251120 新しいタイトル （タイトルのみ変更）
npm run change 251120 251121 （日付/フォルダ名変更）
npm run change 251120 251121 新しいタイトル （両方変更）
```
## 🗑️ 削除 (npm run delete)

```
npm run delete 251120 （指定した日付のフォルダを削除）
```
