import axios, { type AxiosInstance } from 'axios'

export const GITHUB_API = 'https://api.github.com'

export function createGithubClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: GITHUB_API,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    timeout: 15000,
  })
}
