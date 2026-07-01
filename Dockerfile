FROM nginx:alpine

# Copy all files to the default Nginx html directory
COPY . /usr/share/nginx/html

# Expose port 80 for the container
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
```
