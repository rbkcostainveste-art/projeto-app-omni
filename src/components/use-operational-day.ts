"use client";
import {useEffect,useState} from 'react';
import {operationalDay,millisecondsUntilNextOperationalDay} from '@/lib/coordination-day';
export function useOperationalDay(){const [day,setDay]=useState(operationalDay);useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const refresh=()=>{setDay(operationalDay());clearTimeout(timer);timer=setTimeout(refresh,millisecondsUntilNextOperationalDay()+20);};timer=setTimeout(refresh,millisecondsUntilNextOperationalDay()+20);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{clearTimeout(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);return day;}
