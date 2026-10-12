'use client';
import { ChakraProvider, createSystem, defaultConfig } from '@chakra-ui/react';
import { ThemeProvider } from 'next-themes';
const system = createSystem(defaultConfig, {
  preflight: false,
  globalCss: { body: { background: 'var(--paper)', color: 'var(--ink)' } },
  theme: { semanticTokens: { colors: {
    bg: { value: 'var(--surface)' }, fg: { value: 'var(--ink)' },
    border: { value: 'var(--line)' }, 'fg.muted': { value: 'var(--muted)' }
  } } }
});
export default function Provider({ children, nonce }) {
  return <ChakraProvider value={system}><ThemeProvider nonce={nonce} attribute="data-theme" storageKey="vitalia-theme" defaultTheme="system" enableSystem disableTransitionOnChange>{children}</ThemeProvider></ChakraProvider>;
}
