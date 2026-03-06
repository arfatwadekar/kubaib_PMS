import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

// ══════════════════════════════════════════
// Enums
// ══════════════════════════════════════════
export enum AnnouncementStatus {
  Active   = 1,
  Inactive = 0,
}

// ══════════════════════════════════════════
// Types
// ══════════════════════════════════════════
export type AnnouncementCreatePayload = {
  title:       string;
  description: string;
  startDate:   string;
  endDate:     string;
  status:      AnnouncementStatus | number;
};

export type AnnouncementUpdatePayload = AnnouncementCreatePayload;

export type AnnouncementDto = {
  announcementId?: number;
  id?:             number;
  title?:          string;
  description?:    string;
  startDate?:      string;
  endDate?:        string;
  status?:         string | number;
  createdOn?:      string;
  createdDate?:    string;
  modifiedOn?:     string;
};

// ══════════════════════════════════════════
// Service
// ══════════════════════════════════════════
@Injectable({ providedIn: "root" })
export class AnnouncementService {

  private base = environment.apiBaseUrl;

  private EP = {
    BASE:                        `api/Announcement`,
    BY_ID:   (id: number)     => `api/Announcement/${id}`,
    SEARCH:                      `api/Announcement/search`,
    ACTIVE:                      `api/Announcement/active`,
  };

  constructor(private http: HttpClient) {}

  private url(path: string): string {
    return `${this.base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  createAnnouncement(payload: AnnouncementCreatePayload): Observable<any> {
    return this.http.post(this.url(this.EP.BASE), payload);
  }

  // ── Read All (paginated) ──────────────────────────────────────────────────

  /**
   * listing.ts line 76 calls:
   *   this.announcementService.getAnnouncements(this.pageNumber, this.pageSize)
   */
  getAnnouncements(page = 1, pageSize = 10): Observable<any> {
    return this.http.get(
      this.url(`${this.EP.BASE}?page=${page}&pageSize=${pageSize}`)
    );
  }

  /** Convenience alias */
  getAllAnnouncements(page = 1, pageSize = 10): Observable<any> {
    return this.getAnnouncements(page, pageSize);
  }

  // ── Read One ──────────────────────────────────────────────────────────────

  getAnnouncementById(id: number): Observable<any> {
    return this.http.get(this.url(this.EP.BY_ID(id)));
  }

  // ── Update ────────────────────────────────────────────────────────────────

  updateAnnouncement(id: number, payload: AnnouncementUpdatePayload): Observable<any> {
    return this.http.put(this.url(this.EP.BY_ID(id)), payload);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  deleteAnnouncement(id: number): Observable<any> {
    return this.http.delete(this.url(this.EP.BY_ID(id)));
  }

  // ── Search ────────────────────────────────────────────────────────────────

  /**
   * listing.ts line 117 calls:
   *   .searchAnnouncements(title || undefined, status !== '' ? +status : undefined)
   * → 2 params: title?: string, status?: number
   */
  searchAnnouncements(title?: string, status?: number): Observable<any> {
    const q = new URLSearchParams();
    if (title  != null && title !== '') q.set("title",  title);
    if (status != null)                 q.set("status", String(status));
    return this.http.get(this.url(`${this.EP.SEARCH}?${q.toString()}`));
  }

  // ── Active only ───────────────────────────────────────────────────────────

  getActiveAnnouncements(): Observable<any> {
    return this.http.get(this.url(this.EP.ACTIVE));
  }
}