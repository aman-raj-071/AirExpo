# SageMaker setup

Install Python dependencies, collect data, and train locally first. Upload `ml/model.joblib` and a SageMaker-compatible inference artifact to a private S3 bucket. Create a SageMaker model and endpoint only after reviewing endpoint cost; the Node server invokes it with `@aws-sdk/client-sagemaker-runtime` when `AQI_INFERENCE_PROVIDER=sagemaker` and `SAGEMAKER_ENDPOINT_NAME` is set.

No Lambda or API Gateway is required for this integration. The existing Node server remains the API boundary.
