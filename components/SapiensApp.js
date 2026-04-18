'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const ETAPAS=['Aguardando Citacao','Citado — Em Prazo','Em Defesa','Defesa Protocolada','Prorrogacao Solicitada','Prorrogacao Concedida','Em Embargos','Embargo Protocolado','Em Minuta','Minuta Elaborada','Aguardando Pauta','Sustentacao Oral','Retirado de Pauta','Aguardando Publicacao','Julgado — Regular','Julgado — Irregular','Arquivado'];
const NATUREZAS=['Prestacao de Contas','Representacao','Denuncia','Tomada de Contas Especial','Fiscalizacao','Consulta','Recurso','Outros'];
const ESPECIES=['Prestacao de Contas Anual de Governo','Prestacao de Contas Anual de Gestores','Tomada de Contas de Gestores','Representacao — Licitacao','Representacao — Contratos','Representacao — Pessoal','Fiscalizacao de Obras','Fiscalizacao de Contratos','Denuncia','Consulta Juridica','Recurso de Revisao','Embargo de Declaracao','Outros'];