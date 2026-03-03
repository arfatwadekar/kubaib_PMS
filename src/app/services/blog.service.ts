import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class BlogService {

  private base = `${environment.apiBaseUrl}/api/Blog`;

  constructor(private http: HttpClient) {}

  // ── LIST ──────────────────────────────────────────────
  getBlogs(pageNumber = 1, pageSize = 10): Observable<any> {
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    return this.http.get(this.base, { params });
  }

  // ── SEARCH ────────────────────────────────────────────
  searchBlogs(searchTerm: string, pageNumber = 1, pageSize = 10): Observable<any> {
    const params = new HttpParams()
      .set('searchTerm', searchTerm)
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    return this.http.get(`${this.base}/search`, { params });
  }

  // ── GET BY ID ─────────────────────────────────────────
  getBlogById(id: number): Observable<any> {
    return this.http.get(`${this.base}/${id}`);
  }

  // ── CREATE ────────────────────────────────────────────
  createBlog(
    title: string,
    description: string,
    youTubeUrl: string,
    images: File[]
  ): Observable<any> {
    const fd = this.buildForm({ title, description, youTubeUrl }, images, 'Images');
    return this.http.post(this.base, fd);
  }

  // ── UPDATE ────────────────────────────────────────────
  updateBlog(
    id: number,
    blogId: number,
    title: string,
    description: string,
    youTubeUrl: string,
    newImages: File[]
  ): Observable<any> {
    const fd = this.buildForm({ blogId, title, description, youTubeUrl }, newImages, 'NewImages');
    return this.http.put(`${this.base}/${id}`, fd);
  }

  // ── DELETE BLOG ───────────────────────────────────────
  deleteBlog(id: number): Observable<any> {
    return this.http.delete(`${this.base}/${id}`);
  }

  // ── DELETE IMAGE ──────────────────────────────────────
  deleteImage(imageId: number): Observable<any> {
    return this.http.delete(`${this.base}/image/${imageId}`);
  }

  // ── INCREMENT VIEW ────────────────────────────────────
  incrementView(id: number): Observable<any> {
    return this.http.post(`${this.base}/${id}/view`, {});
  }

  // ── LIKE ──────────────────────────────────────────────
  likeBlog(id: number): Observable<any> {
    return this.http.post(`${this.base}/${id}/like`, {});
  }

  // ── HELPER ───────────────────────────────────────────
  private buildForm(fields: Record<string, any>, files: File[], fileKey: string): FormData {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
      if (v != null) fd.append(k, String(v));
    });
    files.forEach(f => fd.append(fileKey, f, f.name));
    return fd;
  }
}