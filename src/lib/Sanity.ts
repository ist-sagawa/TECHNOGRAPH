import { createClient } from "@sanity/client";
import imageUrlBuilder from '@sanity/image-url';
import type { PortableTextBlock } from '@portabletext/types';
import { getFileAsset } from '@sanity/asset-utils';

const client = createClient({
  projectId: "nacdthna",
  dataset: "production",
  apiVersion: '2024-07-02',
  useCdn: true,
});

// 画像取得
type ImageUrlBuilder = ReturnType<typeof imageUrlBuilder>;

export type ImageSource = Parameters<ImageUrlBuilder["image"]>[0];

export const imageUrlFor = (source: ImageSource) =>
  imageUrlBuilder(client).image(source);

// ファイル取得
export const fileUrlFor = (source: any) => {
  const fileAsset = getFileAsset(source._ref, client.config());

  return fileAsset ? fileAsset : null;
};

export default client;

// 投稿取得
export interface Post {
  title: string;
  slug: { current: string };
  body: PortableTextBlock[];
  mainImage?: { asset: { _ref: string } };
  category?: { title: string };
}

export interface CrystalizerImage {
  _id: string;
  title?: string;
  date?: string;
  externalId?: string;
  name?: string;
  message?: string;
  createdAt?: string;
  image?: any;
}

export async function getCrystalizerImages(opts: { limit?: number } = {}): Promise<CrystalizerImage[]> {
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.floor(opts.limit as number)) : 120;
  const query = `*[_type == "crystalizerImage"] | order(coalesce(date, createdAt) desc, createdAt desc) [0...$limit]{
    _id,
    title,
    date,
    externalId,
    name,
    message,
    createdAt,
    image
  }`;
  const images = await client.fetch(query, { limit });
  return Array.isArray(images) ? images : [];
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const query = `*[_type == "post" && slug.current == $slug][0]{title, body, mainImage}`;
  const params = { slug };
  const post = await client.fetch(query, params);
  return post;
}

export async function getAllSlugs(): Promise<{ current: string }[]> {
  const query = `*[_type == "post"]{slug}`;
  const slugs = await client.fetch(query);
  return slugs.map((slug: { slug: { current: string } }) => slug.slug);
}

export async function getPosts(): Promise<Post[]> {
  const query = `*[_type == "post"]{
    title, 
    slug, 
    body, 
    mainImage, 
    _updatedAt, 
    category->{
      title
    }
  }`;
  const posts = await client.fetch(query);
  return posts;
}