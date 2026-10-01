import { env } from 'cloudflare:workers';

export function photosBucket():R2Bucket{
  const bucket=(env as unknown as {PHOTOS?:R2Bucket}).PHOTOS;
  if(!bucket)throw new Error('PHOTOS_UNAVAILABLE');
  return bucket;
}

export const allowedPhotoTypes=new Set(['image/jpeg','image/png','image/webp']);
export const MAX_PHOTO_BYTES=5*1024*1024;

export function photoExtension(type:string){
  if(type==='image/png')return 'png';
  if(type==='image/webp')return 'webp';
  return 'jpg';
}
