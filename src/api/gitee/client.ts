import axios, { type AxiosInstance } from 'axios'

export const GITEE_API = 'https://gitee.com/api/v5'

export function createGiteeClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: GITEE_API,
    params: { access_token: token },
    timeout: 15000,
  })
}
