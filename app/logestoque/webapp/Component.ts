import AppComponent from "sap/fe/core/AppComponent";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace br.dev.imlucas.logestoque
 */
export default class Component extends AppComponent {

	public static metadata = {
		manifest: "json"
	};

	public init(): void {
		super.init();

		this.setModel(new JSONModel(this._getInitialUserPerms()), "userPerms");
		this.setModel(new JSONModel({
			username: "",
			fullName: "",
			canManageMaterials: false,
			canManageWarehouses: false,
			canManageDistributionCenters: false,
			canManageAddresses: false,
			canViewStocks: false,
			hasManagementOptions: false,
			canManageMoviments: false,
			canApproveMoviments: false,
			canConcludeMoviments: false,
			canDeleteMoviments: false,
			isAdmin: false,
			loaded: false
		}), "currentUser");
		this._loadCurrentUser();
	}

	private _loadCurrentUser(): void {
		const token = sessionStorage.getItem("token");
		const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

		fetch("/odata/v4/main/CurrentUser?$top=1", {
			credentials: "include",
			headers
		})
			.then((response) => response.ok ? response.json() : Promise.reject(response))
			.then((data: { value?: Array<Record<string, unknown>> }) => {
				const user = data.value?.[0];
				if (!user) { return; }

				(this.getModel("currentUser") as JSONModel | undefined)?.setData({
					...user,
					loaded: true
				});
				(this.getModel("userPerms") as JSONModel | undefined)?.setData({
					canManageMaterials: !!user.canManageMaterials,
					canManageWarehouses: !!user.canManageWarehouses,
					canManageDistributionCenters: !!user.canManageDistributionCenters,
					canManageAddresses: !!user.canManageAddresses,
					canViewStocks: !!user.canViewStocks,
					hasManagementOptions: !!user.hasManagementOptions,
					canManageMoviments: !!user.canManageMoviments,
					canApproveMoviments: !!user.canApproveMoviments,
					canConcludeMoviments: !!user.canConcludeMoviments,
					canDeleteMoviments: !!user.canDeleteMoviments,
					isAdmin: !!user.isAdmin
				});
			})
			.catch(() => {
				(this.getModel("currentUser") as JSONModel | undefined)?.setProperty("/loaded", false);
			});
	}

	private _getInitialUserPerms(): Record<string, boolean> {
		const mDefaults = {
			canManageMaterials: false,
			canManageWarehouses: false,
			canManageDistributionCenters: false,
			canManageAddresses: false,
			canViewStocks: false,
			hasManagementOptions: false,
			canManageMoviments: false,
			canApproveMoviments: false,
			canConcludeMoviments: false,
			canDeleteMoviments: false,
			isAdmin: false
		};

		const token = sessionStorage.getItem("token");
		if (!token) { return mDefaults; }

		try {
			const raw = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
			const padded = raw + "=".repeat((4 - raw.length % 4) % 4);
			const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
			const roles = Array.isArray(payload.roles) ? payload.roles as string[] : [];
			const hasRole = function (role: string): boolean {
				return roles.indexOf(role) !== -1;
			};

			return {
				canManageMaterials: !!payload.canManageMaterials || hasRole("ESTOQUE") || hasRole("ADMIN"),
				canManageWarehouses: !!payload.canManageWarehouses || hasRole("ESTOQUE") || hasRole("ADMIN"),
				canManageDistributionCenters: !!payload.canManageDistributionCenters || hasRole("ESTOQUE") || hasRole("ADMIN"),
				canManageAddresses: !!payload.canManageAddresses || hasRole("ESTOQUE") || hasRole("ADMIN"),
				canViewStocks: !!payload.canViewStocks || hasRole("ESTOQUE") || hasRole("ADMIN"),
				hasManagementOptions: !!payload.hasManagementOptions || hasRole("ESTOQUE") || hasRole("ADMIN"),
				canManageMoviments: !!payload.canManageMoviments || hasRole("ESTOQUE") || hasRole("LOGISTICA") || hasRole("ADMIN"),
				canApproveMoviments: !!payload.canApproveMoviments || hasRole("APROVACAO") || hasRole("ADMIN"),
				canConcludeMoviments: !!payload.canConcludeMoviments || hasRole("ESTOQUE") || hasRole("ADMIN"),
				canDeleteMoviments: !!payload.canDeleteMoviments || hasRole("ESTOQUE") || hasRole("ADMIN"),
				isAdmin: !!payload.isAdmin
			};
		} catch (_e) {
			return mDefaults;
		}
	}
}
