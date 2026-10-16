'use strict';
(()=>{
 const WHITE=244,PAD=3,SIZE=64;
 function makeCleanFavicon(){
  const img=new Image();
  img.onload=()=>{
   try{
    const w=img.naturalWidth,h=img.naturalHeight;
    if(!w||!h)return;
    const source=document.createElement('canvas');source.width=w;source.height=h;
    const ctx=source.getContext('2d',{willReadFrequently:true});if(!ctx)return;
    ctx.drawImage(img,0,0);
    const frame=ctx.getImageData(0,0,w,h),px=frame.data,seen=new Uint8Array(w*h),stack=[];
    const white=i=>px[i*4]>WHITE&&px[i*4+1]>WHITE&&px[i*4+2]>WHITE&&px[i*4+3]>0;
    const push=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const i=y*w+x;if(seen[i]||!white(i))return;seen[i]=1;stack.push(i)};
    for(let x=0;x<w;x++){push(x,0);push(x,h-1)}
    for(let y=0;y<h;y++){push(0,y);push(w-1,y)}
    while(stack.length){
     const i=stack.pop(),x=i%w,y=(i/w)|0,a=i*4;px[a+3]=0;
     push(x-1,y);push(x+1,y);push(x,y-1);push(x,y+1);
    }
    ctx.putImageData(frame,0,0);
    let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     if(px[(y*w+x)*4+3]>8){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}
    }
    if(maxX<minX||maxY<minY)return;
    const bw=maxX-minX+1,bh=maxY-minY+1,scale=Math.min((SIZE-PAD*2)/bw,(SIZE-PAD*2)/bh);
    const dw=Math.round(bw*scale),dh=Math.round(bh*scale),dx=Math.round((SIZE-dw)/2),dy=Math.round((SIZE-dh)/2);
    const out=document.createElement('canvas');out.width=SIZE;out.height=SIZE;
    const o=out.getContext('2d');if(!o)return;o.imageSmoothingEnabled=true;o.imageSmoothingQuality='high';
    o.drawImage(source,minX,minY,bw,bh,dx,dy,dw,dh);
    let link=document.getElementById('ghfc-favicon');
    if(!link){link=document.createElement('link');link.id='ghfc-favicon';link.rel='icon';document.head.appendChild(link)}
    link.type='image/png';link.sizes='64x64';link.href=out.toDataURL('image/png');
   }catch{}
  };
  img.src='/escudo.jpeg?v=clean-favicon-1';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',makeCleanFavicon,{once:true});
 else makeCleanFavicon();
})();