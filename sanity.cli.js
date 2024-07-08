import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: 'nacdthna', // あなたのプロジェクトID
    dataset: 'production'  // あなたのデータセット
  }
});