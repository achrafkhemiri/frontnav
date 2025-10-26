import { Injectable, Inject, PLATFORM_ID, Optional } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformServer } from '@angular/common';
import { REQUEST } from '@nguniversal/express-engine/tokens';

@Injectable()
export class SsrJwtInterceptor implements HttpInterceptor {
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Optional() @Inject(REQUEST) private request: any
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (isPlatformServer(this.platformId)) {
      // Récupère le cookie JWT côté serveur
      const cookies = this.request.headers?.cookie;
      if (cookies) {
        const jwtMatch = cookies.match(/jwt=([^;]+)/);
        if (jwtMatch) {
          // Ajoute le JWT dans l'en-tête Authorization
          const cloned = req.clone({
            setHeaders: {
              Authorization: `Bearer ${jwtMatch[1]}`
            }
          });
          return next.handle(cloned);
        }
      }
    }
    let modifiedReq = req;
    // Ajoute le JWT côté client pour toutes les requêtes /api/
    if (req.url.includes('/api/')) {
      // Récupère le JWT du cookie côté client
      let jwt = '';
      if (typeof document !== 'undefined') {
        const match = document.cookie.match(/jwt=([^;]+)/);
        if (match) {
          jwt = match[1];
        }
      }
      if (jwt) {
        modifiedReq = modifiedReq.clone({
          setHeaders: {
            Authorization: `Bearer ${jwt}`
          },
          withCredentials: true
        });
      } else {
        modifiedReq = modifiedReq.clone({ withCredentials: true });
      }
    }
    // ...autres traitements éventuels...
    return next.handle(modifiedReq);
  }
}
