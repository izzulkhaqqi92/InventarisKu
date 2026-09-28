"use strict";
const CACHE_NAME="inventarisku-shell-v6.5";
const APP_SHELL=["./","./index.html","./styles.css?v=6.5","./config.js?v=6.5","./app.js?v=6.5","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png","./icons/apple-touch-icon.png","./icons/favicon-32.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const isLocal=url.origin===self.location.origin;
  const isPublicImage=url.hostname.endsWith(".supabase.co")&&url.pathname.includes("/storage/v1/object/public/");
  const isSupabaseLibrary=url.hostname==="cdn.jsdelivr.net"&&url.pathname.includes("/@supabase/supabase-js@");
  if(isPublicImage||isSupabaseLibrary){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response&&(response.ok||response.type==="opaque"))caches.open(CACHE_NAME).then(cache=>cache.put(event.request,response.clone()));return response;})));return;}
  if(!isLocal)return;
  if(event.request.mode==="navigate"){
    event.respondWith((async()=>{const cached=await caches.match("./index.html");const network=fetch(event.request).then(async response=>{if(response?.ok){const cache=await caches.open(CACHE_NAME);await cache.put("./index.html",response.clone());}return response;}).catch(()=>null);if(cached){event.waitUntil(network);return cached;}return(await network)||Response.error();})());return;
  }
  if(url.pathname.endsWith("/config.js")){
    event.respondWith((async()=>{const cached=await caches.match(event.request);const network=fetch(event.request,{cache:"no-store"}).then(async response=>{if(response?.ok){const cache=await caches.open(CACHE_NAME);await cache.put(event.request,response.clone());}return response;}).catch(()=>null);if(cached){event.waitUntil(network);return cached;}return(await network)||Response.error();})());return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response?.ok)caches.open(CACHE_NAME).then(cache=>cache.put(event.request,response.clone()));return response;})));
});
