import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { CorsInterceptor } from './cors-interceptor.service';
import { NgModule } from '@angular/core';

@NgModule({
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CorsInterceptor,
      multi: true
    }
  ]
})
export class AppModule { }