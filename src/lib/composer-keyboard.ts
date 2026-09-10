type ComposerKey = {
 key:string;shiftKey:boolean;ctrlKey?:boolean;altKey?:boolean;metaKey?:boolean;repeat?:boolean;
 nativeEvent?:{isComposing?:boolean;keyCode?:number};preventDefault:()=>void;
};
/** Applies only to message composers, never to selects or record approval forms. */
export function sendOnEnter(event:ComposerKey,send:()=>unknown,disabled=false){
 if(event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||event.nativeEvent?.isComposing||event.nativeEvent?.keyCode===229)return;
 event.preventDefault();
 if(!disabled&&!event.repeat)void send();
}
