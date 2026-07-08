import { apiClient } from './apiClient'
import { pkcs11Service } from './pkcs11Service'
import type {
  DocumentType,
  SignCompleteResponse,
  SignPrepareResponse,
  SignTask
} from '../../shared/types'

export async function listTasks(documentType: DocumentType): Promise<SignTask[]> {
  return apiClient.listSignTasks(documentType)
}

export async function getTaskPreview(taskId: string): Promise<string> {
  return apiClient.getTaskPreviewHtml(taskId)
}

export async function prepareTask(taskId: string): Promise<SignPrepareResponse> {
  const certDer = pkcs11Service.getSelectedCertificateDer()
  if (!certDer) {
    throw new Error('İmzalama için sertifika seçilmedi.')
  }
  return apiClient.prepareSignTask(taskId, certDer)
}

export async function signAndComplete(
  taskId: string,
  pin: string,
  prepared?: SignPrepareResponse
): Promise<SignCompleteResponse> {
  const certDer = pkcs11Service.getSelectedCertificateDer()
  if (!certDer) {
    throw new Error('İmzalama için sertifika seçilmedi.')
  }

  const prepareData = prepared ?? (await prepareTask(taskId))
  const dataToSign = Buffer.from(prepareData.dataToSignBase64, 'base64')

  if (!dataToSign.length) {
    throw new Error('İmzalanacak veri alınamadı.')
  }

  const signature = pkcs11Service.signData(dataToSign, pin, prepareData.algorithm)
  return apiClient.completeSignTask(taskId, signature.toString('base64'), certDer)
}

export async function executeSignFlow(
  _documentType: DocumentType,
  taskId: string,
  pin: string
): Promise<SignCompleteResponse> {
  const prepared = await prepareTask(taskId)
  return signAndComplete(taskId, pin, prepared)
}

/** e-Reçete (Medula) adaptörü */
export const ereceteAdapter = {
  list: () => listTasks('erecete'),
  sign: (taskId: string, pin: string) => executeSignFlow('erecete', taskId, pin)
}

/** e-Arşiv / e-Fatura (XAdES) adaptörü */
export const efaturaAdapter = {
  listEarsiv: () => listTasks('earsiv'),
  listEfatura: () => listTasks('efatura'),
  signEarsiv: (taskId: string, pin: string) => executeSignFlow('earsiv', taskId, pin),
  signEfatura: (taskId: string, pin: string) => executeSignFlow('efatura', taskId, pin)
}
