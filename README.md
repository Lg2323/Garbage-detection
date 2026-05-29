
```
Garbage-detection
├─ .editorconfig
├─ .idea
│  ├─ CoursePractice.iml
│  ├─ inspectionProfiles
│  │  └─ profiles_settings.xml
│  ├─ misc.xml
│  ├─ modules.xml
│  └─ vcs.xml
├─ garbage_control
│  ├─ .dockerignore
│  ├─ ai_verification
│  │  ├─ models
│  │  │  └─ best.pt
│  │  ├─ services.py
│  │  └─ __init__.py
│  ├─ commands.txt
│  ├─ docker-compose.yml
│  ├─ Dockerfile
│  ├─ frontend
│  │  ├─ dist
│  │  │  ├─ assets
│  │  │  │  ├─ bootstrap-icons-BeopsB42.woff
│  │  │  │  ├─ bootstrap-icons-mSm7cUeB.woff2
│  │  │  │  ├─ index-BghILpJc.js
│  │  │  │  ├─ index-CoWw6bk7.css
│  │  │  │  ├─ index-CX3fYTQ3.js
│  │  │  │  ├─ index-DbO57IN-.css
│  │  │  │  ├─ index-DHclw705.js
│  │  │  │  ├─ index-Kc8OZC2v.js
│  │  │  │  └─ logo-DQ05JSJt.png
│  │  │  ├─ index.html
│  │  │  └─ vite.svg
│  │  ├─ eslint.config.js
│  │  ├─ index.html
│  │  ├─ package-lock.json
│  │  ├─ package.json
│  │  ├─ public
│  │  │  └─ vite.svg
│  │  ├─ README.md
│  │  ├─ src
│  │  │  ├─ api
│  │  │  │  ├─ admin.js
│  │  │  │  ├─ auth.js
│  │  │  │  ├─ coord.js
│  │  │  │  ├─ http.js
│  │  │  │  ├─ requests.js
│  │  │  │  ├─ routes.js
│  │  │  │  └─ user.js
│  │  │  ├─ App.jsx
│  │  │  ├─ assets
│  │  │  │  └─ logo.png
│  │  │  ├─ components
│  │  │  │  ├─ admin
│  │  │  │  │  ├─ AdminCrudSection.jsx
│  │  │  │  │  └─ ZoneGeometryEditor.jsx
│  │  │  │  ├─ AppLayout.jsx
│  │  │  │  ├─ city-stats
│  │  │  │  │  ├─ StatsBarChart.jsx
│  │  │  │  │  ├─ StatsFiltersPanel.jsx
│  │  │  │  │  ├─ StatsPieChart.jsx
│  │  │  │  │  ├─ StatsStatusList.jsx
│  │  │  │  │  ├─ StatsSummaryCards.jsx
│  │  │  │  │  └─ StatsTimelineChart.jsx
│  │  │  │  ├─ completed
│  │  │  │  │  ├─ CompletedHeader.jsx
│  │  │  │  │  └─ CompletedRequestCard.jsx
│  │  │  │  ├─ FileDropzone.jsx
│  │  │  │  ├─ maps
│  │  │  │  │  ├─ RequestResponsibilityMap.jsx
│  │  │  │  │  └─ RouteMap.jsx
│  │  │  │  ├─ Notice.jsx
│  │  │  │  ├─ Pagination.jsx
│  │  │  │  ├─ PasswordInput.jsx
│  │  │  │  ├─ requests
│  │  │  │  │  ├─ RequestCreateModal.jsx
│  │  │  │  │  ├─ RequestFiltersPanel.jsx
│  │  │  │  │  ├─ RequestsHeader.jsx
│  │  │  │  │  ├─ RequestsTable.jsx
│  │  │  │  │  └─ status.js
│  │  │  │  └─ RoleGuard.jsx
│  │  │  ├─ hooks
│  │  │  │  └─ useDebouncedValue.js
│  │  │  ├─ main.jsx
│  │  │  ├─ pages
│  │  │  │  ├─ AccessDenied.jsx
│  │  │  │  ├─ admin
│  │  │  │  │  ├─ AdminDashboard.jsx
│  │  │  │  │  ├─ AdminDirectories.jsx
│  │  │  │  │  ├─ AdminLayout.jsx
│  │  │  │  │  ├─ AdminRequestDetail.jsx
│  │  │  │  │  ├─ AdminRequests.jsx
│  │  │  │  │  ├─ AdminUsers.jsx
│  │  │  │  │  └─ AdminZones.jsx
│  │  │  │  ├─ CityStats.jsx
│  │  │  │  ├─ CompletedRequests.jsx
│  │  │  │  ├─ coord
│  │  │  │  │  ├─ CoordMap.jsx
│  │  │  │  │  ├─ CoordRequestDetail.jsx
│  │  │  │  │  └─ CoordRequests.jsx
│  │  │  │  ├─ CreateRequest.jsx
│  │  │  │  ├─ department
│  │  │  │  │  ├─ DepartmentRequestDetail.jsx
│  │  │  │  │  └─ DepartmentRequests.jsx
│  │  │  │  ├─ Faq.jsx
│  │  │  │  ├─ ForgotPassword.jsx
│  │  │  │  ├─ Login.jsx
│  │  │  │  ├─ NotFound.jsx
│  │  │  │  ├─ org
│  │  │  │  │  ├─ OrganizationRequestDetail.jsx
│  │  │  │  │  └─ OrganizationRequests.jsx
│  │  │  │  ├─ Profile.jsx
│  │  │  │  ├─ Register.jsx
│  │  │  │  ├─ RequestsList.jsx
│  │  │  │  ├─ ResetPassword.jsx
│  │  │  │  ├─ routes
│  │  │  │  │  ├─ RouteDetailPage.jsx
│  │  │  │  │  └─ RoutesPage.jsx
│  │  │  │  └─ worker
│  │  │  │     ├─ WorkerRequestDetail.jsx
│  │  │  │     └─ WorkerRequests.jsx
│  │  │  ├─ routes
│  │  │  │  └─ RequireRole.jsx
│  │  │  ├─ styles
│  │  │  │  └─ app.css
│  │  │  ├─ styles.css
│  │  │  ├─ ui
│  │  │  │  └─ status.js
│  │  │  └─ utils
│  │  │     ├─ apiErrors.js
│  │  │     ├─ geocoding.js
│  │  │     └─ requestFilters.js
│  │  └─ vite.config.js
│  ├─ garbage_control
│  │  ├─ asgi.py
│  │  ├─ settings.py
│  │  ├─ urls.py
│  │  ├─ wsgi.py
│  │  └─ __init__.py
│  ├─ manage.py
│  ├─ media
│  │  └─ requests
│  │     ├─ after
│  │     │  ├─ after.jpg
│  │     │  ├─ after_1.png
│  │     │  ├─ after_1_DPOjyxi.png
│  │     │  ├─ after_1_Nq92uTL.png
│  │     │  ├─ after_2.png
│  │     │  ├─ after_2_Fnoi7EG.png
│  │     │  ├─ after_n1c40lQ.jpg
│  │     │  ├─ after_seed_01_almet_containers.jpg
│  │     │  ├─ after_seed_02_almet_park.jpg
│  │     │  ├─ after_seed_03_almet_square.jpg
│  │     │  ├─ after_seed_10_kazan_completed.jpg
│  │     │  ├─ after_seed_15_moscow_underpass.jpg
│  │     │  ├─ after_seed_16_moscow_yard_check.jpg
│  │     │  ├─ ChatGPT_Image_5_февр._2026_г._23_47_10.png
│  │     │  └─ ChatGPT_Image_5_февр._2026_г._23_56_29.png
│  │     └─ before
│  │        ├─ 1800x.jpg
│  │        ├─ 1800x_61Ltmys.jpg
│  │        ├─ 1800x_8GpqV6K.jpg
│  │        ├─ 1800x_cojkuDs.jpg
│  │        ├─ 1800x_rc08g7u.jpg
│  │        ├─ 328e2a5b-bc65-4a7f-88c3-c5917f63af12.jpg
│  │        ├─ 5.jpeg
│  │        ├─ 659f322ebb2dbf3967aaec84b9eff358.jpg
│  │        ├─ 72iz1AhT.jpg
│  │        ├─ 72iz1AhT_gvAG4ms.jpg
│  │        ├─ after.jpg
│  │        ├─ after_1.png
│  │        ├─ after_1FJSPaW.jpg
│  │        ├─ after_1_FAuAeuH.png
│  │        ├─ after_9W1iBvN.jpg
│  │        ├─ after_pBzZexJ.jpg
│  │        ├─ after_QfFxNcP.jpg
│  │        ├─ after_test.jpg
│  │        ├─ after_test_T9Cr5tE.jpg
│  │        ├─ after_test_uXEwgQW.jpg
│  │        ├─ diagram_1.jpg
│  │        ├─ i.jpg
│  │        ├─ image4_1.png
│  │        ├─ i_1.jpg
│  │        ├─ p19ovpi1jvr6f117u1vc0m04brm5.jpg
│  │        ├─ p19ovpi1jvr6f117u1vc0m04brm5_5qPzJgx.jpg
│  │        ├─ p19ovpi1jvr6f117u1vc0m04brm5_GrHWAkz.jpg
│  │        ├─ p19ovpi1jvr6f117u1vc0m04brm5_MZfIHel.jpg
│  │        ├─ p19ovpi1jvr6f117u1vc0m04brm5_Zt5ZDtc.jpg
│  │        ├─ photo_2026-01-06_06-00-59.jpg
│  │        ├─ photo_2026-01-06_06-00-59_6ehDjor.jpg
│  │        ├─ photo_2026-01-06_06-00-59_9SZkyB8.jpg
│  │        ├─ photo_2026-01-06_06-00-59_9VfGsQb.jpg
│  │        ├─ photo_2026-01-06_06-00-59_CEoo7Xl.jpg
│  │        ├─ photo_2026-01-06_06-00-59_OJkvoz9.jpg
│  │        ├─ photo_2026-01-06_06-00-59_UEv7Nh3.jpg
│  │        ├─ photo_2026-01-06_06-00-59_vd8w8o9.jpg
│  │        ├─ photo_2026-01-06_06-00-59_XGxCRNl.jpg
│  │        ├─ photo_2026-01-06_06-00-59_XYiIueT.jpg
│  │        ├─ photo_2026-01-06_06-00-59_yy8sRDu.jpg
│  │        ├─ photo_2026-01-30_12-10-32.jpg
│  │        ├─ photo_2026-01-30_12-10-32_5FoZcrI.jpg
│  │        ├─ photo_2026-01-30_12-10-32_kvbgfzp.jpg
│  │        ├─ photo_2026-01-30_12-10-32_lcbPR5D.jpg
│  │        ├─ photo_2026-01-30_12-10-32_Oi4LXBF.jpg
│  │        ├─ photo_2026-01-30_12-10-32_Po2vnDt.jpg
│  │        ├─ photo_2026-02-03_10-23-35.jpg
│  │        ├─ photo_2026-02-03_10-23-35_73kZLKR.jpg
│  │        ├─ photo_2026-02-03_10-23-35_HsLUfAi.jpg
│  │        ├─ photo_2026-02-03_10-23-35_PMOVpwX.jpg
│  │        ├─ Picture1.png
│  │        ├─ XXXL.jpg
│  │        ├─ XXXL_13W7viP.jpg
│  │        ├─ Снимок_экрана_2026-01-28_220751.png
│  │        └─ Снимок_экрана_2026-01-28_220751_7w5tsHA.png
│  ├─ pytest.ini
│  ├─ requests_app
│  │  ├─ admin.py
│  │  ├─ admin_api.py
│  │  ├─ admin_serializers.py
│  │  ├─ apps.py
│  │  ├─ geocoding.py
│  │  ├─ migrations
│  │  │  ├─ 0001_initial.py
│  │  │  ├─ 0002_alter_request_options.py
│  │  │  ├─ 0003_request_city.py
│  │  │  ├─ 0004_alter_request_options_and_more.py
│  │  │  ├─ 0005_federalsubject_locality_organizationtype_and_more.py
│  │  │  ├─ 0006_seed_reference_data.py
│  │  │  ├─ 0007_route_routepoint_route_route_status_created_idx_and_more.py
│  │  │  ├─ 0008_route_distance_meters_route_duration_seconds_and_more.py
│  │  │  └─ __init__.py
│  │  ├─ models.py
│  │  ├─ permissions.py
│  │  ├─ route_serializers.py
│  │  ├─ route_services.py
│  │  ├─ route_views.py
│  │  ├─ serializers.py
│  │  ├─ services
│  │  │  ├─ routing.py
│  │  │  ├─ __init__.py
│  │  │  └─ __pycache__
│  │  │     └─ routing.cpython-310.pyc
│  │  ├─ static
│  │  │  └─ admin
│  │  │     └─ lock_location_map.js
│  │  ├─ tests.py
│  │  ├─ tests_routes.py
│  │  ├─ urls.py
│  │  ├─ views.py
│  │  └─ __init__.py
│  ├─ requirements.txt
│  ├─ scripts
│  │  └─ reset_and_seed_demo.py
│  ├─ tests
│  │  ├─ conftest.py
│  │  ├─ test_auth.py
│  │  ├─ test_password_reset.py
│  │  ├─ test_permissions.py
│  │  ├─ test_requests_workflow.py
│  │  ├─ test_stats.py
│  │  └─ __init__.py
│  └─ users
│     ├─ admin.py
│     ├─ admin_urls.py
│     ├─ admin_views.py
│     ├─ apps.py
│     ├─ migrations
│     │  ├─ 0001_initial.py
│     │  ├─ 0002_alter_user_id.py
│     │  ├─ 0003_alter_user_options.py
│     │  ├─ 0004_user_city.py
│     │  ├─ 0005_user_department_user_organization_alter_user_role.py
│     │  ├─ 0006_populate_user_affiliations.py
│     │  ├─ 0007_alter_user_role_department_manager.py
│     │  └─ __init__.py
│     ├─ models.py
│     ├─ permissions.py
│     ├─ serializers.py
│     ├─ tests.py
│     ├─ urls.py
│     ├─ views.py
│     └─ __init__.py
└─ README.md

```