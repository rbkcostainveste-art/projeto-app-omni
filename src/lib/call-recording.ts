// A stable canvas/audio stream lets cameras change without restarting MediaRecorder.
export function composeMedia(getStreams:()=>MediaStream[], audio=true) {
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
 const ctx=canvas.getContext('2d')!;
 const output=canvas.captureStream(20), videos=new Map<MediaStream,HTMLVideoElement>();
 const mixer=audio?new AudioContext():null, destination=mixer?.createMediaStreamDestination();
 const sources=new Map<MediaStream,MediaStreamAudioSourceNode>();
 if(destination)output.addTrack(destination.stream.getAudioTracks()[0]);
 if(mixer)void mixer.resume();
 const draw=()=>{
  const streams=getStreams();
  for(const [stream,video] of videos)if(!streams.includes(stream)){video.pause();video.srcObject=null;videos.delete(stream);sources.get(stream)?.disconnect();sources.delete(stream);}
  ctx.fillStyle='#0f172a';ctx.fillRect(0,0,960,540);
  const cols=streams.length>1?2:1,rows=Math.ceil(streams.length/cols)||1,w=960/cols,h=540/rows;
  streams.forEach((stream,i)=>{
   let video=videos.get(stream);if(!video){video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;void video.play().catch(()=>{});videos.set(stream,video);}
   const trackId=stream.getVideoTracks()[0]?.id||'';if(video.dataset.track!==trackId){video.dataset.track=trackId;video.srcObject=null;video.srcObject=stream;void video.play().catch(()=>{});}
   if(mixer&&destination&&stream.getAudioTracks().length&&!sources.has(stream)){const source=mixer.createMediaStreamSource(stream);source.connect(destination);sources.set(stream,source);}
   if(video.readyState>=2&&video.videoWidth){const scale=Math.min(w/video.videoWidth,h/video.videoHeight),vw=video.videoWidth*scale,vh=video.videoHeight*scale;ctx.drawImage(video,(i%cols)*w+(w-vw)/2,Math.floor(i/cols)*h+(h-vh)/2,vw,vh);}
  });
 };
 let closed=false;
 draw();const timer=setInterval(draw,50);
 return {stream:output,close:()=>{if(closed)return;closed=true;clearInterval(timer);videos.forEach(v=>{v.pause();v.srcObject=null;});sources.forEach(s=>s.disconnect());output.getTracks().forEach(t=>t.stop());if(mixer)void mixer.close();}};
}
