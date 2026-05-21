import { Injectable, inject } from '@angular/core';

import { AuthService } from './auth.service';
import {
  MODULE_NAV,
  ModuleNavItem,
  isTopLevelNavModule,
  nestedModulesForParent,
} from '../shared/module-hierarchy';

@Injectable({ providedIn: 'root' })
export class ModuleNavService {
  private auth = inject(AuthService);

  visibleTopLevel(): ModuleNavItem[] {
    const enabled = this.auth.me()?.enabled_modules ?? [];
    const parents = this.auth.moduleParents();
    return MODULE_NAV.filter(
      (item) =>
        this.auth.hasPermission(item.permission) &&
        isTopLevelNavModule({
          module: item.module,
          enabledModules: enabled,
          moduleParents: parents,
        })
    );
  }

  nestedChildren(parentModule: string): string[] {
    const enabled = this.auth.me()?.enabled_modules ?? [];
    return nestedModulesForParent(parentModule, enabled, this.auth.moduleParents());
  }
}
