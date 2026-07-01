# Regras de Sprint e Deploy

## Fluxo de Deploy Obrigatório
Após o repositório estar conectado ao GitHub, toda Sprint futura deve seguir automaticamente o seguinte fluxo:
1. Desenvolvimento
2. Commit das alterações
3. Push para o repositório
4. Deploy automático na Vercel
5. Geração do Link de Homologação
6. Geração do Relatório Final da Sprint

## Relatório Final da Sprint
O Relatório Final da Sprint deve conter as seguintes informações obrigatórias:
* Número da versão
* Data da publicação
* Link atualizado do ambiente de homologação
* Resumo das funcionalidades implementadas
* Checklist para homologação
* Ambiente (Desenvolvimento, Homologação ou Produção)
* Hash ou identificador do commit publicado
* Tempo da Sprint
* Pendências conhecidas
* Próxima Sprint planejada

## Regra de Conclusão de Sprint
CRITICAL: O Antigravity nunca poderá informar que uma Sprint foi concluída sem apresentar evidências da publicação.

A entrega obrigatória passa a ser:
1. Código implementado.
2. Changelog atualizado.
3. Commit realizado.
4. Deploy concluído.
5. URL da Vercel funcionando.
6. Checklist de homologação.

Só depois disso o status muda para Concluída.
Nenhuma Sprint será considerada concluída enquanto o ambiente de homologação não estiver atualizado e disponível para validação pelo usuário.
