'use client';
import {useEffect,useState} from 'react';
import {IconButton} from '@chakra-ui/react';
import {useTheme} from 'next-themes';
import Icon from './icon';

export default function ThemeToggle({id}) {
  const [mounted,setMounted]=useState(false);
  const {resolvedTheme,setTheme}=useTheme();
  useEffect(()=>setMounted(true),[]);
  const dark=mounted&&resolvedTheme==='dark';
  return <IconButton unstyled type="button" id={id} className="theme-toggle" aria-label={dark?'Activar modo claro':'Activar modo oscuro'} aria-pressed={dark} onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}><span className="theme-sun"><Icon name="sun"/></span><span className="theme-moon"><Icon name="moon"/></span></IconButton>;
}
