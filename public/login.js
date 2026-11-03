document.querySelector('#login-form').addEventListener('submit',async e=>{
 e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;
 const message=document.querySelector('#login-error');message.textContent='';
 try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});if(!r.ok){const v=await r.json();throw Error(v.error||'No se pudo iniciar sesión.');}location.assign('/');}catch(err){message.textContent=err.message;}finally{button.disabled=false;}
});
