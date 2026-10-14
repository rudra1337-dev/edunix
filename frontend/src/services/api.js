const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const BASE_URL =
  env.VITE_API_BASE_URL ||
  env.VITE_API_URL ||
  'http://localhost:5000/api';

const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
  };
};

const handleResponse = async (res) => {
  let data;
  try {
    data = await res.json();
  } catch {
    data = { message: res.statusText || 'Request failed' };
  }

  if (!res.ok) {
    const error = new Error(data.message || 'Request failed');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
};

export const apiGet = (path) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  }).then(handleResponse);

export const apiPost = (path, body) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  }).then(handleResponse);

export const apiPut = (path, body) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: getHeaders(),
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  }).then(handleResponse);

export const apiDelete = (path) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  }).then(handleResponse);
