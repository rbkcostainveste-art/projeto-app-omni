export class CallMediaError extends Error {
 constructor(public device:'microphone'|'camera'|'browser',public reason:string){
  const label=device==='camera'?'a câmera':'o microfone';
  super(reason==='insecure'?'Abra o aplicativo pelo endereço HTTPS para usar câmera e microfone.':reason==='unsupported'?'Este navegador não oferece acesso aos dispositivos da chamada. Abra o aplicativo diretamente no Chrome ou Safari atualizado.':['NotAllowedError','SecurityError'].includes(reason)?`O navegador não liberou ${label}. Confira as permissões do site e do celular abaixo.`:['NotReadableError','AbortError'].includes(reason)?`Não foi possível abrir ${label}. Encerre outras chamadas ou gravações e tente novamente.`:reason==='NotFoundError'?`O navegador não encontrou ${label}. Confira se o dispositivo está disponível.`:`Não foi possível acessar ${label}. Confira as permissões e tente novamente.`);
  this.name='CallMediaError';
 }
}

// Request separately so a denied camera cannot be reported as a microphone error.
// Nothing is sent or joined until all requested devices have opened successfully.
export async function captureCallMedia(mode:'audio'|'video'):Promise<MediaStream>{
 if(!window.isSecureContext)throw new CallMediaError('browser','insecure');
 if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined')throw new CallMediaError('browser','unsupported');
 let media:MediaStream;
 try{media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});}
 catch(e){throw new CallMediaError('microphone',(e as Error).name);}
 if(mode==='video'){
  try{const camera=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:20}}});camera.getVideoTracks().forEach(track=>media.addTrack(track));}
  catch(e){media.getTracks().forEach(track=>track.stop());throw new CallMediaError('camera',(e as Error).name);}
 }
 return media;
}
