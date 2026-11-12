import { supabase } from '../core/supabase.js';
import { enviarArquivo, urlAssinada } from './storage.js';

export const TIPOS_DOCUMENTO = { identificacao: 'Identificação', comprovante_endereco: 'Comprovante de endereço', outro: 'Outro' };

export async function listar(devedorId) {
  const { data, error } = await supabase.from('devedor_documentos')
    .select('id, tipo, nome_original, storage_path, mime_type, tamanho_bytes, created_at')
    .eq('devedor_id', devedorId).is('removido_em', null).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function adicionar(devedorId, tipo, file) {
  const up = await enviarArquivo('documento', devedorId, file);
  const { data, error } = await supabase.from('devedor_documentos').insert({
    devedor_id: devedorId, tipo, nome_original: String(up.nome_original).slice(0, 255),
    storage_path: up.path, mime_type: up.mime_type, tamanho_bytes: up.tamanho_bytes,
  }).select().single();
  if (error) throw error;
  return data;
}

/** Remoção lógica (o arquivo permanece no storage até a política de retenção ser definida). */
export async function remover(id) {
  const { error } = await supabase.from('devedor_documentos').update({ removido_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export const urlDocumento = (doc) => urlAssinada('documento', doc.storage_path, 60);
