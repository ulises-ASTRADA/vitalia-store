'use client';
import { Dialog, Portal, IconButton } from '@chakra-ui/react';
export default function Modal({open,onClose,title,children,help=false}) {
  return <Dialog.Root open={open} onOpenChange={({open})=>!open&&onClose()} placement="center" lazyMount unmountOnExit><Portal><Dialog.Backdrop/><Dialog.Positioner><Dialog.Content className={help?'help-dialog':'product-dialog'} bg="var(--surface)" color="var(--ink)" overflowY="auto"><Dialog.Title className="sr-only">{title}</Dialog.Title><Dialog.CloseTrigger asChild><IconButton unstyled className="close-button" aria-label="Cerrar">×</IconButton></Dialog.CloseTrigger>{children}</Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>;
}
