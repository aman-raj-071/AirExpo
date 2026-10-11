import {createRoot} from 'react-dom/client';
import {useEffect, useState} from 'react';
import App from './App.tsx';
import {LandingPage} from './components/LandingPage';
import {AuthPage} from './components/AuthPage';
import {getCognitoCurrentUser, signOutFromCognito} from './auth/amplify';
import './index.css';
function Website(){
 const [path,setPath]=useState(window.location.pathname),[user,setUser]=useState<Awaited<ReturnType<typeof getCognitoCurrentUser>>>(null),[loading,setLoading]=useState(true),[fresh,setFresh]=useState(false);
 const navigate=(url:string)=>{window.history.pushState({},'',url);setPath(url);window.scrollTo(0,0);};
 useEffect(()=>{let active=true;void getCognitoCurrentUser().then(value=>{if(active){setUser(value);setLoading(false);}});const pop=()=>setPath(window.location.pathname);window.addEventListener('popstate',pop);return()=>{active=false;window.removeEventListener('popstate',pop);};},[]);
 async function signedIn(){const value=await getCognitoCurrentUser();if(!value)throw Error('Your session could not be verified. Please sign in again.');setUser(value);setFresh(true);navigate('/dashboard');}
 const enter=()=>navigate(user?'/dashboard':'/signin');
 if(loading)return <main role="status" className="min-h-screen bg-background p-10">Loading AirExpo…</main>;
 if(path==='/signin'||path==='/auth/callback'||(path==='/dashboard'&&!user))return <AuthPage onSuccess={signedIn} onHome={()=>navigate('/')}/>;
 if(path==='/dashboard'&&user)return <App onHome={()=>navigate('/')} initialProfileOpen={fresh} onProfileConsumed={()=>setFresh(false)} onSignOut={async()=>{await signOutFromCognito();setUser(null);setFresh(false);navigate('/');}}/>;
 return <LandingPage onEnter={enter} onSignIn={enter}/>;
}
createRoot(document.getElementById('root')!).render(<Website/>);
