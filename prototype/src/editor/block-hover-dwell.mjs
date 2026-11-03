export function createBlockHoverDwell(onSelect, {delay=140,schedule=setTimeout,cancel=clearTimeout}={}) {
  let active=null,pending=null,timer=null;
  const clear=()=>{
    if(timer!==null)cancel(timer);
    timer=null;
    pending=null;
  };
  return {
    aim(block){
      if(block===active){clear();return active}
      if(block===pending)return active;
      clear();
      if(active===null){active=block;onSelect(block);return active}
      pending=block;
      timer=schedule(()=>{timer=null;active=pending;pending=null;onSelect(active)},delay);
      return active;
    },
    current:()=>active,
    leave:clear,
    reset(){clear();active=null},
  };
}
