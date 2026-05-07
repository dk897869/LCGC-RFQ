import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './src/app/core/interceptors/auth-interceptor';

export const appConfig = {
  providers:[
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};